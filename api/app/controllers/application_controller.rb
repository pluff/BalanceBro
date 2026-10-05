class ApplicationController < ActionController::API
  before_action :authenticate!
  # A change and its audit row are saved together or not at all.
  around_action :atomically, unless: -> { request.get? }

  attr_reader :current_user

  rescue_from ActiveRecord::RecordNotFound do
    render json: { error: "not_found" }, status: :not_found
  end

  rescue_from ActiveRecord::RecordInvalid do |e|
    render json: { error: "invalid", details: e.record.errors }, status: :unprocessable_entity
  end

  private

  def atomically(&) = ApplicationRecord.transaction(&)

  # Records who did what in a pot. `subject` is the record acted on, `details` what changed.
  def audit(action, subject = nil, details = {}, group: @group, actor: current_user)
    AuditLog.create!(group_id: group.id, actor_id: actor&.id, actor_name: actor&.name, action: action,
                     subject_type: subject&.class&.name, subject_id: subject&.id, details: details, ip: request.remote_ip, source: "ui")
  end

  # Pot from the URL for any member (owner or joined via share link).
  def set_group = @group = Group.accessible_by(current_user).find(params[:group_id])

  # Renaming, deleting and sharing stay with the pot's owner.
  def require_owner!
    render json: { error: "forbidden" }, status: :forbidden unless @group.owned_by?(current_user)
  end

  def user_from_token
    token = request.authorization.to_s.delete_prefix("Bearer ").presence
    Session.find_by(token: token)&.user if token
  end

  def authenticate!
    @current_user = user_from_token
    render json: { error: "unauthorized" }, status: :unauthorized unless @current_user
  end
end
