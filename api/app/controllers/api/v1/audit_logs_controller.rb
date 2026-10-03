module Api
  module V1
    # The pot's audit trail, newest first. Owner only. Cursor paging: pass `before` (a log id) for older rows.
    class AuditLogsController < ApplicationController
      before_action :set_group
      before_action :require_owner!

      def index = render(json: AuditLog.page_for(@group, before: params[:before]))
    end
  end
end
