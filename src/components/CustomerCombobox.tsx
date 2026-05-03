import { useState } from "react";
import { Check, ChevronsUpDown, UserCircle2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type CustomerOption = { id: string; name: string; phone?: string | null };

interface Props {
  customers: CustomerOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}

export function CustomerCombobox({ customers, value, onChange, placeholder = "নাম বা ফোন দিয়ে খুঁজুন..." }: Props) {
  const [open, setOpen] = useState(false);
  const selected = customers.find(c => c.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm font-medium text-left hover:bg-accent/40 transition-colors"
        >
          <span className={cn("truncate flex items-center gap-1.5", !selected && "text-muted-foreground font-normal")}>
            <UserCircle2 className="h-4 w-4 shrink-0" />
            {selected ? `${selected.name}${selected.phone ? ` · ${selected.phone}` : ""}` : "সাধারণ ক্রেতা"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(val, search) => {
            const s = search.toLowerCase();
            return val.toLowerCase().includes(s) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>কোনো ক্রেতা নেই</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="walk-in সাধারণ"
                onSelect={() => { onChange(""); setOpen(false); }}
              >
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                সাধারণ ক্রেতা (Walk-in)
              </CommandItem>
              {customers.map(c => (
                <CommandItem
                  key={c.id}
                  value={`${c.name} ${c.phone ?? ""}`}
                  onSelect={() => { onChange(c.id); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === c.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span className="font-medium">{c.name}</span>
                    {c.phone && <span className="text-xs text-muted-foreground">{c.phone}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
