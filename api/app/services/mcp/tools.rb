module Mcp
  # The tools exposed over MCP. They follow the same rules as the REST API: only pots the user owns or joined
  # are visible. Any member may add expenses and paybacks (same as the REST API).
  class Tools
    class Error < StandardError; end

    POT_ID = { type: "integer", description: "Pot id from list_pots." }.freeze
    CENTS = { type: "integer", minimum: 1, description: "Amount in cents of the pot's currency (12.50 => 1250)." }.freeze

    DEFINITIONS = [
      { name: "list_pots",
        description: "List the MoneyPots (shared expense groups) the user owns or has joined.",
        inputSchema: { type: "object", properties: {} },
        annotations: { readOnlyHint: true } },
      { name: "get_pot",
        description: "Everything in one pot: people, saved participant groups, all expenses (with the per-person split), " \
                     "all paybacks, each person's net balance and the transfers that would settle everyone. " \
                     "Positive balance = the pot owes them; negative = they owe the pot.",
        inputSchema: { type: "object", properties: { pot_id: POT_ID }, required: %w[pot_id] },
        annotations: { readOnlyHint: true } },
      { name: "get_audit_logs",
        description: "The pot's audit trail (who added, edited or deleted what, and when), newest first. Owner only. " \
                     "Returns up to 50 entries; pass the returned next_before as `before` for older ones.",
        inputSchema: { type: "object", required: %w[pot_id], properties: {
          pot_id: POT_ID,
          before: { type: "integer", description: "Log id cursor: only entries older than this. Use next_before from the previous page." }
        } },
        annotations: { readOnlyHint: true } },
      { name: "add_expense",
        description: "Add an expense that one person paid and several share equally. Call get_pot first to learn the person ids.",
        inputSchema: { type: "object", required: %w[pot_id description amount_cents], properties: {
          pot_id: POT_ID,
          description: { type: "string" },
          amount_cents: CENTS,
          paid_by_id: { type: "integer", description: "Person who paid. Defaults to the user's own person in the pot." },
          participant_ids: { type: "array", items: { type: "integer" }, description: "People sharing it. Defaults to everyone in the pot unless participant_group_ids is given." },
          participant_group_ids: { type: "array", items: { type: "integer" }, description: "Saved participant groups whose members share it." },
          spent_on: { type: "string", format: "date", description: "YYYY-MM-DD. Defaults to today." }
        } },
        annotations: { readOnlyHint: false, destructiveHint: false } },
      { name: "add_payback",
        description: "Record that one person paid money back to another (a settlement).",
        inputSchema: { type: "object", required: %w[pot_id from_participant_id to_participant_id amount_cents], properties: {
          pot_id: POT_ID,
          from_participant_id: { type: "integer", description: "Person who paid the money." },
          to_participant_id: { type: "integer", description: "Person who received it." },
          amount_cents: CENTS,
          settled_on: { type: "string", format: "date", description: "YYYY-MM-DD. Defaults to today." },
          description: { type: "string" }
        } },
        annotations: { readOnlyHint: false, destructiveHint: false } }
    ].freeze

    def initialize(user, ip: nil)
      @user = user
      @ip = ip
    end

    def call(name, args)
      schema = DEFINITIONS.find { |t| t[:name] == name }&.fetch(:inputSchema) or raise Error, "Unknown tool: #{name}"
      missing = schema.fetch(:required, []) - args.keys
      raise Error, "Missing arguments: #{missing.join(', ')}" if missing.any?
      public_send(name, **args.symbolize_keys.slice(*schema[:properties].keys))
    end

    def list_pots
      { pots: Group.accessible_by(@user).order(:name).map { |g| pot_summary(g) } }
    end

    def get_pot(pot_id:)
      pot = find_pot(pot_id)
      order = pot.participants.map(&:id)
      balances = GroupBalances.new(pot)
      pot_summary(pot).merge(
        your_participant_id: pot.participants.find { |p| p.user_id == @user.id }&.id,
        participants: pot.participants.map { |p| p.as_json(only: %i[id name short_name]) },
        participant_groups: pot.participant_groups.includes(:participants).map { |g| ParticipantGroupsController.serialize(g) },
        expenses: pot.expenses.includes(Api::V1::ExpensesController::INCLUDES).order(spent_on: :desc, id: :desc).map { |e| expense_json(e, order) },
        paybacks: pot.settlements.order(settled_on: :desc, id: :desc).as_json(only: SETTLEMENT_FIELDS),
        balances: balances.balances.map { |id, c| { participant_id: id, amount_cents: c } },
        suggested_transfers: balances.transfers.map(&:to_h)
      )
    end

    def get_audit_logs(pot_id:, before: nil)
      pot = find_pot(pot_id)
      raise Error, "Only the pot's owner can view the audit logs." unless pot.owned_by?(@user)
      AuditLog.page_for(pot, before: before)
    end

    def add_expense(pot_id:, description:, amount_cents:, paid_by_id: nil, participant_ids: nil, participant_group_ids: nil, spent_on: nil)
      pot = find_pot(pot_id)
      cents!(amount_cents)
      paid_by_id ||= pot.participants.find { |p| p.user_id == @user.id }&.id
      raise Error, "paid_by_id is required: you have no person in this pot." unless paid_by_id
      participant_ids = pot.participants.map(&:id) if participant_ids.blank? && participant_group_ids.blank?

      expense = pot.expenses.new(description: description, amount_cents: amount_cents, paid_by_id: paid_by_id,
                                 spent_on: parse_date(spent_on))
      Array(participant_ids).uniq.each { |id| expense.shares.build(participant_id: id) }
      Array(participant_group_ids).uniq.each { |id| expense.shares.build(participant_group_id: id) }

      order = pot.participants.map(&:id)
      Expense.transaction do
        expense.save!
        audit(pot, "expense.create", expense, expense_json(expense, order))
      end
      expense_json(expense, order)
    end

    def add_payback(pot_id:, from_participant_id:, to_participant_id:, amount_cents:, settled_on: nil, description: nil)
      pot = find_pot(pot_id)
      cents!(amount_cents)

      payback = pot.settlements.new(from_participant_id: from_participant_id, to_participant_id: to_participant_id,
                                    amount_cents: amount_cents, settled_on: parse_date(settled_on), description: description)
      Settlement.transaction do
        payback.save!
        audit(pot, "settlement.create", payback, payback.as_json(only: SETTLEMENT_FIELDS))
      end
      payback.as_json(only: SETTLEMENT_FIELDS)
    end

    private

    SETTLEMENT_FIELDS = Api::V1::SettlementsController::FIELDS

    def find_pot(id) = Group.accessible_by(@user).find(id)

    def pot_summary(pot)
      pot.as_json(only: %i[id name currency]).merge(is_owner: pot.owned_by?(@user))
    end

    # Same shape as the REST API: `splits` is derived, participant_ids / participant_group_ids are what is stored.
    def expense_json(e, order)
      e.as_json(only: %i[id description amount_cents spent_on paid_by_id])
       .merge(participant_ids: e.shares.filter_map(&:participant_id),
              participant_group_ids: e.shares.filter_map(&:participant_group_id),
              splits: e.split_amounts(order).map { |pid, cents| { participant_id: pid, amount_cents: cents } })
    end

    def cents!(value)
      raise Error, "amount_cents must be a whole number of cents." unless value.is_a?(Integer)
    end

    def parse_date(value)
      value.present? ? Date.iso8601(value.to_s) : Date.current
    rescue Date::Error
      raise Error, "Dates must look like YYYY-MM-DD."
    end

    def audit(pot, action, subject, details)
      AuditLog.create!(group_id: pot.id, actor_id: @user.id, actor_name: @user.name, action: action,
                       subject_type: subject.class.name, subject_id: subject.id, details: details, ip: @ip)
    end
  end
end
