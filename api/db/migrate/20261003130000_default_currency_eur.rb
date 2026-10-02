class DefaultCurrencyEur < ActiveRecord::Migration[8.1]
  def change
    change_column_default :groups, :currency, from: "USD", to: "EUR"
  end
end
