# Database Model

## Collections

### members

```ts
{
  id: string;
  display_name: string;
  login_id: string;
  contact: string; // X account or email
  member_rank: number;
  internal_exp: number; // hidden from UI
  additional_signal: number;
  daily_signal_progress_count: number;
  last_daily_login_at: Timestamp;
  entity_stage: number;
  entity_type?: string;
  created_at: Timestamp;
}
```

### acts

```ts
{
  id: string;
  name: string;
  role: 'regular' | 'fresh' | 'organizer';
  icon_url: string;
  video_url?: string;
  music_url?: string;
  x_url?: string;
  embed_url?: string;
  operator_comment?: string;
  self_comment?: string;
  observer_rank: number;
  signal_total: number;
  is_active: boolean;
}
```

### events

```ts
{
  id: string;
  title: string;
  date: string;
  open_time: string;
  start_time: string;
  venue: string;
  flyer_url?: string;
  reservation_url?: string;
  streaming_ticket_url?: string;
  is_active: boolean;
}
```

### signal_submissions

```ts
{
  id: string;
  member_id: string;
  act_id: string;
  event_id: string;
  reaction: string;
  message: string; // max 30 chars
  used_additional_signal: boolean;
  grants_progress: boolean;
  status: 'pending' | 'approved' | 'rejected';
  created_at: Timestamp;
  approved_at?: Timestamp;
}
```

### archive_items

```ts
{
  id: string;
  title: string;
  event_id: string;
  date: string;
  embed_url: string;
  thumbnail_url?: string;
  is_active: boolean;
}
```

### member_archive_unlocks

```ts
{
  member_id: string;
  archive_id: string;
  unlocked_by: string;
  unlocked_at: Timestamp;
}
```

### member_action_logs

```ts
{
  id: string;
  member_id: string;
  action_type: 'daily_login' | 'signal' | 'visit' | 'merch' | 'archive_unlock' | 'admin_grant';
  internal_exp_delta: number;
  created_at: Timestamp;
  metadata?: Record<string, unknown>;
}
```
