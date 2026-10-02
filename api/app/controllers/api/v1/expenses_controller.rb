module Api
  module V1
    class ExpensesController < ApplicationController
      before_action :set_group
      before_action :require_owner!, only: :destroy

      INCLUDES = { shares: { participant_group: :participants } }.freeze

      def index
        order = @group.participants.map(&:id)
        render json: @group.expenses.includes(INCLUDES).order(spent_on: :desc, id: :desc).map { |e| json(e, order) }
      end

      # params: description, amount_cents, spent_on, paid_by_id, participant_ids: [...], participant_group_ids: [...]
      # The expense is split equally between the union of those people and the *current* members of those groups.
      def create
        expense = @group.expenses.new(params.permit(:description, :amount_cents, :spent_on, :paid_by_id))
        Array(params[:participant_ids]).uniq.each { |pid| expense.shares.build(participant_id: pid) }
        Array(params[:participant_group_ids]).uniq.each { |gid| expense.shares.build(participant_group_id: gid) }
        expense.save!
        audit("expense.create", expense, json(expense, @group.participants.map(&:id)))
        render json: json(expense, @group.participants.map(&:id)), status: :created
      end

      def destroy
        expense = @group.expenses.includes(INCLUDES).find(params[:id])
        snapshot = json(expense, @group.participants.map(&:id))
        expense.destroy
        audit("expense.delete", expense, snapshot)
        head :no_content
      end

      private

      # `splits` is derived (amount per person right now); participant_ids / participant_group_ids are what is stored.
      def json(e, order)
        e.as_json(only: %i[id description amount_cents spent_on paid_by_id])
         .merge(participant_ids: e.shares.filter_map(&:participant_id),
                participant_group_ids: e.shares.filter_map(&:participant_group_id),
                splits: e.split_amounts(order).map { |pid, cents| { participant_id: pid, amount_cents: cents } })
      end
    end
  end
end
