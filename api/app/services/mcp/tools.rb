module Mcp
  # The tools exposed over MCP. They follow the same rules as the REST API: only pots the user owns or joined
  # are visible. Any member may add expenses and paybacks (same as the REST API).
  class Tools
    class Error < StandardError; end

    POT_ID = { type: "integer", description: "MoneyPot id, from list_pots." }.freeze
    CENTS = { type: "integer", minimum: 1, description: "Whole amount in cents of the pot's currency, e.g. 12.50 => 1250. Always positive." }.freeze
    PERSON = "Participant id from get_pot (a person in the pot, not necessarily a BalanceBro user).".freeze

    DEFINITIONS = [
      { name: "list_pots",
        description: "List the user's BalanceBro MoneyPots (shared expense groups for splitting costs with friends, trips, " \
                     "households) with id, name, currency and whether the user owns it. Start here to find a pot id " \
                     "when the user mentions a pot by name.",
        inputSchema: { type: "object", properties: {} },
        annotations: { title: "List MoneyPots", readOnlyHint: true } },
      { name: "get_pot",
        description: "Read everything in one BalanceBro MoneyPot: people (participants), saved participant groups, every " \
                     "expense (who paid, total, and each person's share), every payback, each person's net balance and the " \
                     "minimal transfers that would settle everyone. Use it to answer who owes whom, what was spent, or to " \
                     "look up participant ids before adding records. Balances: positive = the pot owes that person, " \
                     "negative = they owe the pot. All amounts are integer cents.",
        inputSchema: { type: "object", properties: { pot_id: POT_ID }, required: %w[pot_id] },
        annotations: { title: "Get MoneyPot details", readOnlyHint: true } },
      { name: "add_expense",
        description: "Record a new expense in a BalanceBro MoneyPot: one person paid, and the cost is split equally between " \
                     "the chosen people. Use for \"I paid 40 for dinner\" or \"Anna bought groceries for the three of us\". " \
                     "Call get_pot first to get participant ids. This changes data: confirm ambiguous details (amount, " \
                     "who shared it) with the user before calling.",
        inputSchema: { type: "object", required: %w[pot_id description amount_cents], properties: {
          pot_id: POT_ID,
          description: { type: "string", description: "What the money was spent on, e.g. \"Dinner\"." },
          amount_cents: CENTS,
          paid_by_id: { type: "integer", description: "#{PERSON} Who paid. Defaults to the user's own person in the pot." },
          participant_ids: { type: "array", items: { type: "integer" }, description: "People who share the cost. Defaults to everyone in the pot unless participant_group_ids is given." },
          participant_group_ids: { type: "array", items: { type: "integer" }, description: "Saved participant groups (from get_pot) whose current members share the cost." },
          spent_on: { type: "string", format: "date", description: "YYYY-MM-DD. Defaults to today." }
        } },
        annotations: { title: "Add expense", readOnlyHint: false, destructiveHint: false } },
      { name: "add_payback",
        description: "Record that one person paid money back to another in a BalanceBro MoneyPot (a settlement). Use for " \
                     "\"Bob gave me 20 back\" or \"I paid Anna what I owed\". It reduces what they owe each other; it is " \
                     "not a new expense. Call get_pot first to get participant ids. This changes data: confirm the " \
                     "direction and amount with the user if unclear.",
        inputSchema: { type: "object", required: %w[pot_id from_participant_id to_participant_id amount_cents], properties: {
          pot_id: POT_ID,
          from_participant_id: { type: "integer", description: "#{PERSON} The person who paid the money." },
          to_participant_id: { type: "integer", description: "#{PERSON} The person who received it. Must differ from the payer." },
          amount_cents: CENTS,
          settled_on: { type: "string", format: "date", description: "YYYY-MM-DD. Defaults to today." },
          description: { type: "string", description: "Optional note, e.g. \"cash\"." }
        } },
        annotations: { title: "Add payback", readOnlyHint: false, destructiveHint: false } }
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
