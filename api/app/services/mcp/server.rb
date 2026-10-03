module Mcp
  # JSON-RPC 2.0 dispatch for the MCP methods we need: initialize, ping, tools/list, tools/call.
  class Server
    PROTOCOL_VERSIONS = %w[2025-06-18 2025-03-26 2024-11-05].freeze

    INSTRUCTIONS = <<~TEXT.freeze
      BalanceBro tracks shared expenses between people. Costs live in MoneyPots (a trip, a flat, a dinner group). Use these
      tools whenever the user talks about their pots, who owes whom, splitting a cost, or paying someone back.

      Workflow: list_pots to find the pot id, get_pot to read people, expenses, paybacks and balances (and to learn the
      participant ids), then add_expense or add_payback to record something.
      - An expense is money spent: one person paid and several share it equally. If nobody shares it yet, add it with
        unallocated: true; it is flagged and left out of balances until people are assigned in the app. A payback is money handed from one person
        to another to settle up; never record a payback as an expense.
      - Amounts are integer cents of the pot's currency (12.50 => 1250). Participants are people in the pot and may have no
        BalanceBro account; match the names the user says to get_pot's participants.
      - Writing tools change shared data that other members see. If the pot, amount, payer or who shares the cost is unclear, ask
        the user first. After writing, tell the user exactly what was recorded.
    TEXT

    def initialize(user, ip: nil)
      @user = user
      @tools = Tools.new(user, ip: ip)
    end

    # Returns the response hash, or nil for notifications (no id).
    def call(message)
      return error(nil, -32600, "Invalid Request") unless message.is_a?(Hash) && message["method"].is_a?(String)

      id = message["id"]
      return if id.nil? # notifications (e.g. notifications/initialized) need no answer

      case message["method"]
      when "initialize" then result(id, initialize_result(message["params"]))
      when "ping" then result(id, {})
      when "tools/list" then result(id, { tools: Tools::DEFINITIONS })
      when "tools/call" then result(id, call_tool(message["params"]))
      else error(id, -32601, "Method not found")
      end
    end

    private

    def initialize_result(params)
      asked = params.is_a?(Hash) ? params["protocolVersion"] : nil
      { protocolVersion: PROTOCOL_VERSIONS.include?(asked) ? asked : PROTOCOL_VERSIONS.first,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "balancebro", version: "1.0.0" },
        instructions: INSTRUCTIONS }
    end

    def call_tool(params)
      params = {} unless params.is_a?(Hash)
      output = @tools.call(params["name"].to_s, params["arguments"].is_a?(Hash) ? params["arguments"] : {})
      { content: [ { type: "text", text: JSON.pretty_generate(output) } ], structuredContent: output, isError: false }
    rescue Tools::Error => e
      failure(e.message)
    rescue ActiveRecord::RecordNotFound
      failure("Not found: the pot, person or group does not exist or you have no access to it.")
    rescue ActiveRecord::RecordInvalid => e
      failure("Invalid: #{e.record.errors.full_messages.to_sentence}")
    rescue StandardError => e
      Rails.logger.error("MCP tool failed: #{e.class}: #{e.message}\n#{e.backtrace.first(10).join("\n")}")
      failure("Internal error while running the tool. Try again later.")
    end

    def failure(text) = { content: [ { type: "text", text: text } ], isError: true }

    def result(id, payload) = { jsonrpc: "2.0", id: id, result: payload }

    def error(id, code, message) = { jsonrpc: "2.0", id: id, error: { code: code, message: message } }
  end
end
