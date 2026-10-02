module Api
  module V1
    class SessionsController < ApplicationController
      skip_before_action :authenticate!, only: :google

      # POST /api/v1/auth/google { id_token }
      def google
        user = User.from_google(GoogleIdentity.verify(params[:id_token]))
        render json: { token: user.sessions.create!.token, user: user.as_json(only: %i[id email name avatar_url]) },
               status: :created
      rescue GoogleIdentity::Error
        render json: { error: "invalid_google_token" }, status: :unauthorized
      end

      def destroy
        Session.find_by(token: request.authorization.to_s.delete_prefix("Bearer "))&.destroy
        head :no_content
      end
    end
  end
end
