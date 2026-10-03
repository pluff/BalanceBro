module Api
  module V1
    class GroupsController < ApplicationController
      before_action :set_pot, only: %i[show update destroy balances]
      before_action :set_deleted_pot, only: %i[restore purge]
      before_action :require_owner!, only: %i[update destroy]

      def index
        render json: Group.accessible_by(current_user).order(:name).map { |g| json(g) }
      end

      # The owner is automatically the first participant.
      def create
        group = Group.transaction do
          g = current_user.groups.create!(params.permit(:name, :currency))
          g.participants.create!(name: current_user.name.to_s.first(Participant::NAME_MAX), user: current_user)
          g
        end
        audit("group.create", group, { name: group.name, currency: group.currency }, group: group)
        render json: json(group), status: :created
      end

      def show
        render json: json(@group).merge(participants: @group.participants.includes(:user).map { |p| p.as_json(only: %i[id name short_name user_id]).merge(avatar_url: p.user&.avatar_url) },
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

      # Soft delete (owner only): the pot moves to "deleted" with all its data.
      def destroy
        @group.destroy!
        audit("group.delete", @group, { name: @group.name })
        head :no_content
      end

      # The owner's deleted pots, newest deletion first.
      def deleted
        render json: Group.deleted.where(owner_id: current_user.id).order(deleted_at: :desc)
                          .map { |g| g.as_json(only: %i[id name currency deleted_at]) }
      end

      def restore
        @group.restore!
        audit("group.restore", @group, { name: @group.name })
        render json: json(@group)
      end

      # Permanent delete of a deleted pot and everything in it (people, expenses, paybacks, audit logs).
      def purge
        @group.purge!
        head :no_content
      end

      def balances
        calc = GroupBalances.new(@group)
        render json: { balances: calc.balances.map { |id, c| { participant_id: id, amount_cents: c } },
                       transfers: calc.transfers.map(&:to_h),
                       unallocated_count: calc.unallocated_count }
      end

      private

      def set_pot = @group = Group.accessible_by(current_user).find(params[:id])

      # Only the owner sees (and can restore or purge) a deleted pot.
      def set_deleted_pot = @group = Group.deleted.find_by!(id: params[:id], owner_id: current_user.id)

      # The share link is a secret: only the owner ever sees it.
      def json(g)
        out = g.as_json(only: %i[id name currency owner_id]).merge(is_owner: g.owned_by?(current_user))
        out[:share_token] = g.share_token if g.owned_by?(current_user)
        out
      end
    end
  end
end
