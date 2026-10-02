module Api
  module V1
    class SettlementsController < ApplicationController
      before_action :set_group
      before_action :require_owner!, only: %i[create update destroy]

      FIELDS = %i[id from_participant_id to_participant_id amount_cents settled_on description].freeze

      def index
        render json: @group.settlements.order(settled_on: :desc).as_json(only: FIELDS)
      end

      def create
        s = @group.settlements.new(settlement_params)
        s.settled_on ||= Date.current
        s.save!
        audit("settlement.create", s, s.as_json(only: FIELDS))
        render json: s.as_json(only: FIELDS), status: :created
      end

      def update
        s = @group.settlements.find(params[:id])
        before = s.as_json(only: FIELDS)
        s.update!(settlement_params)
        audit("settlement.update", s, { before: before, after: s.as_json(only: FIELDS) })
        render json: s.as_json(only: FIELDS)
      end

      def destroy
        s = @group.settlements.find(params[:id])
        snapshot = s.as_json(only: FIELDS)
        s.destroy!
        audit("settlement.delete", s, snapshot)
        head :no_content
      end

      private

      def settlement_params = params.permit(:from_participant_id, :to_participant_id, :amount_cents, :settled_on, :description)
    end
  end
end
