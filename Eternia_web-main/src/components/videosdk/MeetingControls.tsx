import { useMeeting } from "@videosdk.live/react-sdk";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  AlertTriangle,
  RefreshCw,
  Volume2,
  Headphones,
  Bluetooth,
  Smartphone,
  Speaker,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";

interface MeetingControlsProps {
  audioOnly?: boolean;
  onEscalate?: () => void;
  onSwitchCamera?: () => void;
  audioOutputs?: MediaDeviceInfo[];
  selectedSpeaker?: string;
  onSpeakerChange?: (deviceId: string) => void;
  volumeBoost?: number;
  onVolumeBoostChange?: (boost: number) => void;
}

const MeetingControls = ({
  audioOnly = false,
  onEscalate,
  onSwitchCamera,
  audioOutputs = [],
  selectedSpeaker = "",
  onSpeakerChange,
  volumeBoost = 1.0,
  onVolumeBoostChange,
}: MeetingControlsProps) => {
  const { leave, toggleMic, toggleWebcam, localMicOn, localWebcamOn } = useMeeting();

  const getDeviceIcon = (label: string) => {
    const lowercase = label.toLowerCase();
    if (lowercase.includes("bluetooth")) return <Bluetooth className="w-4 h-4" />;
    if (lowercase.includes("headphone") || lowercase.includes("earphone") || lowercase.includes("headset")) {
      return <Headphones className="w-4 h-4" />;
    }
    if (lowercase.includes("speaker") || lowercase.includes("loudspeaker")) {
      return <Speaker className="w-4 h-4" />;
    }
    return <Smartphone className="w-4 h-4" />;
  };

  const supportsSinkId = typeof HTMLAudioElement.prototype.setSinkId === "function";

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 p-4 bg-card border-t border-border shrink-0">
      <Button
        variant={localMicOn ? "outline" : "destructive"}
        size="icon"
        className="rounded-full w-12 h-12"
        onClick={() => toggleMic()}
      >
        {localMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
      </Button>

      {!audioOnly && (
        <>
          <Button
            variant={localWebcamOn ? "outline" : "destructive"}
            size="icon"
            className="rounded-full w-12 h-12"
            onClick={() => toggleWebcam()}
          >
            {localWebcamOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </Button>

          {localWebcamOn && onSwitchCamera && (
            <Button
              variant="outline"
              size="icon"
              className="rounded-full w-12 h-12"
              onClick={onSwitchCamera}
              title="Switch Camera"
            >
              <RefreshCw className="w-5 h-5" />
            </Button>
          )}
        </>
      )}

      {/* Audio Output Routing Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="rounded-full w-12 h-12 relative"
            title="Audio Settings"
          >
            <Volume2 className="w-5 h-5" />
            {volumeBoost > 1.0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-7 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground leading-none">
                {volumeBoost}x
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-64 p-2">
          <DropdownMenuLabel className="text-xs text-muted-foreground font-display font-semibold">
            Audio Output
          </DropdownMenuLabel>
          
          {supportsSinkId && audioOutputs.length > 0 ? (
            audioOutputs.map((device) => (
              <DropdownMenuItem
                key={device.deviceId}
                onClick={() => onSpeakerChange?.(device.deviceId)}
                className={`flex items-center gap-2 cursor-pointer text-sm py-2 rounded-md ${
                  selectedSpeaker === device.deviceId
                    ? "bg-primary/10 text-primary font-medium"
                    : ""
                }`}
              >
                {getDeviceIcon(device.label)}
                <span className="truncate max-w-[180px]">{device.label || "Speaker/Receiver"}</span>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="px-2 py-3 text-xs text-muted-foreground leading-relaxed bg-muted/40 rounded-lg border border-border">
              {supportsSinkId
                ? "No output devices found."
                : "Speaker selection is not supported by your browser (e.g. iOS Safari). Route audio via your system Control Center."}
            </div>
          )}

          <DropdownMenuSeparator className="my-2" />

          {/* Volume Boost Toggle */}
          <div className="flex items-center justify-between px-2 py-2.5 rounded-lg bg-card border border-border/40">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold font-display">Volume Boost</span>
              <span className="text-[10px] text-muted-foreground leading-none">Fixes low mobile sound</span>
            </div>
            <Switch
              checked={volumeBoost > 1.0}
              onCheckedChange={(checked) => onVolumeBoostChange?.(checked ? 2.5 : 1.0)}
            />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {onEscalate && (
        <Button
          variant="outline"
          size="icon"
          className="rounded-full w-12 h-12 border-destructive/50 text-destructive hover:bg-destructive/10"
          onClick={onEscalate}
          title="Escalate to SPOC"
        >
          <AlertTriangle className="w-5 h-5" />
        </Button>
      )}

      <Button
        variant="destructive"
        size="icon"
        className="rounded-full w-14 h-14"
        onClick={() => leave()}
      >
        <PhoneOff className="w-6 h-6" />
      </Button>
    </div>
  );
};

export default MeetingControls;
