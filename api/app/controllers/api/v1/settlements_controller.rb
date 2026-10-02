module Api
  module V1
    class SettlementsController < ApplicationController
      before_action :set_group
      before_action :require_owner!, only: :create

      FIELDS = %i[id from_participant_id to_participant_id amount_cents settled_on].freeze

      def index
        render json: @group.settlements.order(settled_on: :desc).as_json(only: FIELDS)
      end

      def create
        s = @group.settlements.new(params.permit(:from_participant_id, :to_participant_id, :amount_cents, :settled_on))
        s.settled_on ||= Date.current
        s.save!
        audit("settlement.create", s, s.as_json(only: FIELDS))
        render json: s.as_json(only: FIELDS), status: :created
      end
    end
  end
end
