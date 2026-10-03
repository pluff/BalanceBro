module Mcp
  # JSON-RPC 2.0 dispatch for the MCP methods we need: initialize, ping, tools/list, tools/call.
  class Server
    PROTOCOL_VERSIONS = %w[2025-06-18 2025-03-26 2024-11-05].freeze

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
        instructions: "BalanceBro splits expenses between people in MoneyPots. Amounts are integer cents in the pot's currency." }
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
    end

    def failure(text) = { content: [ { type: "text", text: text } ], isError: true }

    def result(id, payload) = { jsonrpc: "2.0", id: id, result: payload }

    def error(id, code, message) = { jsonrpc: "2.0", id: id, error: { code: code, message: message } }
  end
end
