# Net balance per participant in a pot, in cents.
# Positive = group owes them, negative = they owe the group.
# #transfers returns a minimal-ish list of payments that settle everyone.
class GroupBalances
  Transfer = Struct.new(:from_participant_id, :to_participant_id, :amount_cents)

  def initialize(group)
    @group = group
  end

  def balances
    @balances ||= begin
      net = Hash.new(0)
      order = @group.participants.map(&:id)
      @group.expenses.includes(shares: { participant_group: :participants }).each do |e|
        next if e.unallocated?(order) # nobody owes the payer yet
        net[e.paid_by_id] += e.amount_cents
        e.split_amounts(order).each { |pid, cents| net[pid] -= cents }
      end
      @group.settlements.each do |s|
        net[s.from_participant_id] += s.amount_cents
        net[s.to_participant_id] -= s.amount_cents
      end
      net
    end
  end

  # Expenses nobody shares yet; they are not part of balances or transfers.
  def unallocated_count
    @unallocated_count ||= begin
      order = @group.participants.map(&:id)
      @group.expenses.includes(shares: { participant_group: :participants }).count { |e| e.unallocated?(order) }
    end
  end

  def transfers
    debtors   = balances.select { |_, v| v < 0 }.map { |id, v| [id, -v] }.sort_by { |_, v| -v }
    creditors = balances.select { |_, v| v > 0 }.map { |id, v| [id, v] }.sort_by { |_, v| -v }
    result = []

    until debtors.empty? || creditors.empty?
      d_id, d_amt = debtors.first
      c_id, c_amt = creditors.first
      pay = [d_amt, c_amt].min
      result << Transfer.new(d_id, c_id, pay)

      d_amt == pay ? debtors.shift : debtors[0] = [d_id, d_amt - pay]
      c_amt == pay ? creditors.shift : creditors[0] = [c_id, c_amt - pay]
    end

    result
  end
end
