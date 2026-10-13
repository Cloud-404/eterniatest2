import { Bell, CheckCheck, Calendar, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications } from "@/hooks/useNotifications";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const iconMap: Record<string, typeof Bell> = {
  reschedule: RefreshCw,
  emergency_escalation: AlertTriangle,
  appointment: Calendar,
};

const NotificationBell = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="w-4.5 h-4.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 max-h-[400px] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="gap-1 h-7 text-[11px] text-muted-foreground" onClick={() => markAllAsRead()}>
              <CheckCheck className="w-3 h-3" />Mark all read
            </Button>
          )}
        </div>
        <div className="overflow-y-auto flex-1">
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No notifications</div>
          ) : (
            notifications.map((n) => {
              const Icon = iconMap[n.type] || Bell;
              return (
                <button
                  key={n.id}
                  onClick={() => { if (!n.is_read) markAsRead(n.id); }}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-border/30 hover:bg-muted/30 transition-colors",
                    !n.is_read && "bg-primary/5"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                      n.type === "emergency_escalation" ? "bg-destructive/10" : "bg-primary/10"
                    )}>
                      <Icon className={cn("w-4 h-4", n.type === "emergency_escalation" ? "text-destructive" : "text-primary")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium truncate", !n.is_read && "font-semibold")}>{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(n.created_at), "MMM d, h:mm a")}</p>
                    </div>
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
