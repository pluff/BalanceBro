# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_10_03_150000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "audit_logs", force: :cascade do |t|
    t.bigint "group_id", null: false
    t.bigint "actor_id"
    t.string "actor_name"
    t.string "action", null: false
    t.string "subject_type"
    t.bigint "subject_id"
    t.jsonb "details", default: {}, null: false
    t.string "ip"
    t.datetime "created_at", null: false
    t.index ["actor_id"], name: "index_audit_logs_on_actor_id"
    t.index ["group_id", "created_at"], name: "index_audit_logs_on_group_id_and_created_at"
    t.index ["subject_type", "subject_id"], name: "index_audit_logs_on_subject_type_and_subject_id"
  end

  create_table "expense_shares", force: :cascade do |t|
    t.bigint "expense_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "participant_id"
    t.bigint "participant_group_id"
    t.index ["expense_id"], name: "index_expense_shares_on_expense_id"
    t.index ["participant_group_id"], name: "index_expense_shares_on_participant_group_id"
    t.index ["participant_id"], name: "index_expense_shares_on_participant_id"
    t.check_constraint "(participant_id IS NULL) <> (participant_group_id IS NULL)", name: "expense_shares_exactly_one_target"
  end

  create_table "expenses", force: :cascade do |t|
    t.bigint "group_id", null: false
    t.string "description", null: false
    t.bigint "amount_cents", null: false
    t.date "spent_on", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "paid_by_id", null: false
    t.index ["group_id"], name: "index_expenses_on_group_id"
    t.index ["paid_by_id"], name: "index_expenses_on_paid_by_id"
  end

  create_table "group_memberships", force: :cascade do |t|
    t.bigint "group_id", null: false
    t.bigint "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["group_id", "user_id"], name: "index_group_memberships_on_group_id_and_user_id", unique: true
    t.index ["group_id"], name: "index_group_memberships_on_group_id"
    t.index ["user_id"], name: "index_group_memberships_on_user_id"
  end

  create_table "groups", force: :cascade do |t|
    t.string "name", null: false
    t.string "currency", default: "EUR", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "owner_id", null: false
    t.string "share_token"
    t.index ["owner_id"], name: "index_groups_on_owner_id"
    t.index ["share_token"], name: "index_groups_on_share_token", unique: true
  end

  create_table "participant_group_members", force: :cascade do |t|
    t.bigint "participant_group_id", null: false
    t.bigint "participant_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["participant_group_id", "participant_id"], name: "index_participant_group_members_uniqueness", unique: true
    t.index ["participant_group_id"], name: "index_participant_group_members_on_participant_group_id"
    t.index ["participant_id"], name: "index_participant_group_members_on_participant_id"
  end

  create_table "participant_groups", force: :cascade do |t|
    t.bigint "group_id", null: false
    t.string "name", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index "group_id, lower((name)::text)", name: "index_participant_groups_on_group_and_lower_name", unique: true
    t.index ["group_id"], name: "index_participant_groups_on_group_id"
  end

  create_table "participants", force: :cascade do |t|
    t.bigint "group_id", null: false
    t.string "name", null: false
    t.bigint "user_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "position", default: 0, null: false
    t.string "short_name", null: false
    t.index "group_id, lower((name)::text)", name: "index_participants_on_group_and_lower_name", unique: true
    t.index ["group_id", "position"], name: "index_participants_on_group_id_and_position"
    t.index ["group_id"], name: "index_participants_on_group_id"
    t.index ["user_id"], name: "index_participants_on_user_id"
  end

  create_table "sessions", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "token", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["token"], name: "index_sessions_on_token", unique: true
    t.index ["user_id"], name: "index_sessions_on_user_id"
  end

  create_table "settlements", force: :cascade do |t|
    t.bigint "group_id", null: false
    t.bigint "amount_cents", null: false
    t.date "settled_on", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "from_participant_id", null: false
    t.bigint "to_participant_id", null: false
    t.string "description"
    t.index ["from_participant_id"], name: "index_settlements_on_from_participant_id"
    t.index ["group_id"], name: "index_settlements_on_group_id"
    t.index ["to_participant_id"], name: "index_settlements_on_to_participant_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "email", null: false
    t.string "name", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "google_sub"
    t.string "avatar_url"
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["google_sub"], name: "index_users_on_google_sub", unique: true
  end

  add_foreign_key "expense_shares", "expenses"
  add_foreign_key "expense_shares", "participant_groups"
  add_foreign_key "expense_shares", "participants"
  add_foreign_key "expenses", "groups"
  add_foreign_key "expenses", "participants", column: "paid_by_id"
  add_foreign_key "group_memberships", "groups"
  add_foreign_key "group_memberships", "users"
  add_foreign_key "groups", "users", column: "owner_id"
  add_foreign_key "participant_group_members", "participant_groups"
  add_foreign_key "participant_group_members", "participants"
  add_foreign_key "participant_groups", "groups"
  add_foreign_key "participants", "groups"
  add_foreign_key "participants", "users"
  add_foreign_key "sessions", "users"
  add_foreign_key "settlements", "groups"
  add_foreign_key "settlements", "participants", column: "from_participant_id"
  add_foreign_key "settlements", "participants", column: "to_participant_id"
end
