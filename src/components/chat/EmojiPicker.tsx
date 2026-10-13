import { useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const EMOJI_CATEGORIES = [
  { label: "Smileys", emojis: ["😊", "😂", "🥰", "😅", "😢", "😭", "🤗", "😤", "😔", "🥺", "😌", "🤔", "😳", "🫣", "😴", "🤯"] },
  { label: "Gestures", emojis: ["👋", "🤝", "🙏", "💪", "👍", "👎", "❤️", "💜", "🫶", "✨", "🔥", "💫", "🌟", "🎉", "💐", "🌈"] },
  { label: "Nature", emojis: ["🌸", "🌻", "🍃", "🌊", "☀️", "🌙", "⭐", "🦋", "🐾", "🌿", "🍀", "🌺"] },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

const EmojiPicker = ({ onSelect }: EmojiPickerProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground">
          <Smile className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" side="top" align="start">
        {EMOJI_CATEGORIES.map((cat) => (
          <div key={cat.label} className="mb-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">{cat.label}</p>
            <div className="grid grid-cols-8 gap-0.5">
              {cat.emojis.map((emoji) => (
                <button
                  key={emoji}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-lg"
                  onClick={() => { onSelect(emoji); setOpen(false); }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
};

export default EmojiPicker;
