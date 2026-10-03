Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  # OAuth 2.1 authorization server + MCP endpoint (see OauthController, McpController)
  get  ".well-known/oauth-protected-resource(/*path)", to: "oauth#resource_metadata"
  get  ".well-known/oauth-authorization-server",        to: "oauth#server_metadata"
  post "oauth/register",  to: "oauth#register"
  get  "oauth/authorize", to: "oauth#authorize"
  post "oauth/authorize", to: "oauth#approve"
  post "oauth/token",     to: "oauth#token"
  post "mcp", to: "mcp#handle"
  match "mcp", to: "mcp#unsupported", via: %i[get delete]

  namespace :api do
    namespace :v1 do
      post   "auth/google", to: "sessions#google"
      delete "session",     to: "sessions#destroy"
      get    "me",          to: "users#me"
      get    "join/:token", to: "joins#show"
      post   "join",        to: "joins#create"

      resources :groups, only: %i[index create show update destroy] do
        get :deleted, on: :collection
        post :restore, on: :member
        delete :purge, on: :member
        resource :share, only: %i[create destroy]
        get :balances, on: :member
        resources :participants, only: %i[create update destroy] do
          put :order, action: :reorder, on: :collection
        end
        resources :participant_groups, only: %i[create update destroy]
        resources :expenses, only: %i[index create update destroy]
        resources :settlements, only: %i[index create update destroy]
        resources :audit_logs, only: :index
      end
    end
  end
end
