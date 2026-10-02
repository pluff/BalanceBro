module Api
  module V1
    # The owner's share link: POST creates it (or returns the current one), DELETE revokes it.
    # Revoking stops new people joining; people who already joined keep access.
    class SharesController < ApplicationController
      before_action :set_group
      before_action :require_owner!

      def create
        already = @group.share_token.present?
        @group.enable_sharing!
        audit("share.enable", @group, { already_enabled: already }) # the token itself is a secret, never logged
        render json: { share_token: @group.share_token }, status: :created
      end

      def destroy
        @group.disable_sharing!
        audit("share.disable", @group)
        head :no_content
      end
    end
  end
end
