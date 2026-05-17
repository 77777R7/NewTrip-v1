create table public.player_photos (
  photo_id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(player_id) on delete cascade,
  trip_id uuid not null references public.player_trips(trip_id) on delete cascade,
  landmark_id uuid not null references public.landmarks(landmark_id),
  photo_card_key text not null,
  quality_score integer not null check (quality_score between 0 and 100),
  weather text not null,
  day_phase text not null,
  cleanliness_at_shot numeric(5,2) not null,
  is_first_photo boolean not null,
  reward_tx_id uuid references public.wallet_transactions(transaction_id),
  complete_landmark_idempotency_key text,
  taken_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index idx_player_photos_player_taken
  on public.player_photos(player_id, taken_at desc);

create index idx_player_photos_trip
  on public.player_photos(trip_id, taken_at desc);

create index idx_player_photos_landmark
  on public.player_photos(landmark_id, taken_at desc);

create unique index uq_first_photo_per_landmark
  on public.player_photos(player_id, landmark_id)
  where is_first_photo = true;

create unique index uq_player_photo_complete_landmark_key
  on public.player_photos(player_id, complete_landmark_idempotency_key)
  where complete_landmark_idempotency_key is not null;

alter table public.player_photos enable row level security;
