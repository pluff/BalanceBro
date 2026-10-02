Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      post   "auth/google", to: "sessions#google"
      delete "session",     to: "sessions#destroy"
      get    "me",          to: "users#me"
      get    "join/:token", to: "joins#show"
      post   "join",        to: "joins#create"

      resources :groups, only: %i[index create show update] do
        resource :share, only: %i[create destroy]
        get :balances, on: :member
        resources :participants, only: %i[create update destroy] do
          put :order, action: :reorder, on: :collection
        end
        resources :participant_groups, only: %i[create update destroy]
        resources :expenses, only: %i[index create update destroy]
        resources :settlements, only: %i[index create update destroy]
      end
    end
  end
end
