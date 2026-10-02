module Api
  module V1
    class UsersController < ApplicationController
      def me
        render json: current_user.as_json(only: %i[id email name avatar_url])
      end
    end
  end
end
