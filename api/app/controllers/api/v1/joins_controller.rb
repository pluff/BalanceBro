module Api
  module V1
    # Share-link entry. No sign-in needed: without a session a guest account is created for the chosen/typed
    # name and its session token is returned (store it like a login token).
    class JoinsController < ApplicationController
      skip_before_action :authenticate!

      # GET /join/:token - what the join page shows: the pot and who can be picked (everyone but the owner).
      def show
        group = find_group
        user = user_from_token
        render json: { group_id: group.id, name: group.name, member: user.present? && group.member?(user),
                       participants: group.claimable_participants.as_json(only: %i[id name]) }
      end

      # POST /join { token, participant_id } to be an existing person, or { token, name } to be a new one.
      def create
        group = find_group
        session = nil
        Group.transaction do
          user = user_from_token
          unless user
            name = params[:participant_id].present? ? group.claimable_participants.find(params[:participant_id]).name : params[:name].to_s
            return render json: { error: "name_required" }, status: :unprocessable_entity if name.strip.empty?
            user = User.create_guest!(name)
            session = user.sessions.create!
          end
          person = group.join!(user, participant_id: params[:participant_id], name: params[:name])
          if person
            audit("share.join", person, { participant_name: person.name, claimed_existing: params[:participant_id].present?,
                                          replaced_user_id: person.saved_change_to_user_id&.first,
                                          guest_account_created: session.present?, google_account: user.google_sub.present? },
                  group: group, actor: user)
          end
          render json: group.as_json(only: %i[id name currency]).merge(is_owner: group.owned_by?(user), token: session&.token)
        end
      end

      private

      def find_group = Group.where.not(share_token: nil).find_by!(share_token: params[:token].to_s)
    end
  end
end
