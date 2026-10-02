module Api
  module V1
    # Named sets of participants, used as one-click shortcuts when splitting an expense.
    class ParticipantGroupsController < ApplicationController
      before_action :set_group
      before_action :require_owner!, only: %i[update destroy] # members may create groups, not change or drop them

      def self.serialize(pg) = { id: pg.id, name: pg.name, participant_ids: pg.participants.map(&:id).sort }

      # POST /groups/:group_id/participant_groups { name, participant_ids: [...] }
      def create
        pg = ParticipantGroup.transaction do
          g = @group.participant_groups.create!(name: params[:name].to_s)
          g.participants = members
          g
        end
        audit("participant_group.create", pg, self.class.serialize(pg))
        render json: self.class.serialize(pg), status: :created
      end

      def update
        pg = @group.participant_groups.find(params[:id])
        before = self.class.serialize(pg)
        ParticipantGroup.transaction do
          pg.update!(name: params[:name].to_s) if params.key?(:name)
          pg.participants = members if params.key?(:participant_ids)
        end
        audit("participant_group.update", pg, { from: before, to: self.class.serialize(pg.reload) })
        render json: self.class.serialize(pg)
      end

      # Refused (422) while any expense is split with this group.
      def destroy
        pg = @group.participant_groups.find(params[:id])
        snapshot = self.class.serialize(pg)
        if pg.destroy
          audit("participant_group.delete", pg, snapshot)
          head :no_content
        else
          render json: { error: "cannot_delete", details: pg.errors.full_messages }, status: :unprocessable_entity
        end
      end

      private

      # Only people from this pot may be members.
      def members
        ids = Array(params[:participant_ids]).map(&:to_i)
        raise ActiveRecord::RecordInvalid, ParticipantGroup.new.tap { |g| g.errors.add(:participant_ids, "can't be empty") } if ids.empty?
        @group.participants.where(id: ids)
      end
    end
  end
end
