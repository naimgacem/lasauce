export type NotificationType =
  | "match_found"
  | "match_confirmed"
  | "item_claimed"
  | "item_closed"
  | "system";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  is_read: boolean;
  item_id: string | null;
  match_id: string | null;
  created_at: string;
}

export interface NotificationQuery {
  unread_only?: boolean;
  page?: number;
  page_size?: number;
}
