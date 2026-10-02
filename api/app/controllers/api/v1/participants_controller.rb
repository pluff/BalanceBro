module Api
  module V1
    class ParticipantsController < ApplicationController
      before_action :set_group
      before_action :require_owner! # members can't touch people; they only add expenses and groups

      FIELDS = %i[id name user_id].freeze

      # POST /groups/:group_id/participants { name } - people don't need an account.
      def create
        p = @group.participants.create!(name: params[:name].to_s)
        audit("participant.create", p, { name: p.name })
        render json: p.as_json(only: FIELDS), status: :created
      end

      def update
        p = @group.participants.find(params[:id])
        p.update!(name: params[:name].to_s)
        audit("participant.rename", p, { name: p.saved_change_to_name }) if p.saved_change_to_name?
        render json: p.as_json(only: FIELDS)
      end

      # Refused (422) for the owner and for anyone referenced by an expense or settlement.
      def destroy
        p = @group.participants.find(params[:id])
        snapshot = p.as_json(only: FIELDS)
        if p.destroy
          audit("participant.delete", p, snapshot)
          head :no_content
        else
          render json: { error: "cannot_delete", details: p.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PUT /groups/:group_id/participants/order { ids: [...] } - must list every participant exactly once.
      def reorder
        ids = Array(params[:ids]).map(&:to_i)
        current = @group.participants.pluck(:id)
        return render json: { error: "invalid_order" }, status: :unprocessable_entity if ids.sort != current.sort

        before = current
        Participant.transaction { ids.each_with_index { |id, i| @group.participants.where(id: id).update_all(position: i + 1) } }
        audit("participant.reorder", nil, { from: before, to: ids })
        render json: @group.participants.reload.as_json(only: FIELDS)
      end
    end
  end
end
