module Api
  module V1
    class GroupsController < ApplicationController
      before_action :set_pot, only: %i[show update balances]
      before_action :require_owner!, only: :update

      def index
        render json: Group.accessible_by(current_user).order(:name).map { |g| json(g) }
      end

      # The owner is automatically the first participant.
      def create
        group = Group.transaction do
          g = current_user.groups.create!(params.permit(:name, :currency))
          g.participants.create!(name: current_user.name, user: current_user)
          g
        end
        audit("group.create", group, { name: group.name, currency: group.currency }, group: group)
        render json: json(group), status: :created
      end

      def show
        render json: json(@group).merge(participants: @group.participants.includes(:user).map { |p| p.as_json(only: %i[id name user_id]).merge(avatar_url: p.user&.avatar_url) },
                                        participant_groups: @group.participant_groups.map { |g| ParticipantGroupsController.serialize(g) })
      end

      # Rename and/or change currency (owner only). Amounts are plain cents, so changing the currency only
      # relabels them; it does not convert.
      def update
        @group.update!(params.permit(:name, :currency))
        audit("group.rename", @group, { name: @group.saved_change_to_name }) if @group.saved_change_to_name?
        audit("group.currency", @group, { currency: @group.saved_change_to_currency }) if @group.saved_change_to_currency?
        render json: json(@group)
      end

      def balances
        calc = GroupBalances.new(@group)
        render json: { balances: calc.balances.map { |id, c| { participant_id: id, amount_cents: c } },
                       transfers: calc.transfers.map(&:to_h) }
      end

      private

      def set_pot = @group = Group.accessible_by(current_user).find(params[:id])

      # The share link is a secret: only the owner ever sees it.
      def json(g)
        out = g.as_json(only: %i[id name currency owner_id]).merge(is_owner: g.owned_by?(current_user))
        out[:share_token] = g.share_token if g.owned_by?(current_user)
        out
      end
    end
  end
end
