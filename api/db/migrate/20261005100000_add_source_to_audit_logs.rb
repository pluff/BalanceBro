class AddSourceToAuditLogs < ActiveRecord::Migration[8.1]
  def change
    add_column :audit_logs, :source, :string, null: false, default: "ui"
  end
end
