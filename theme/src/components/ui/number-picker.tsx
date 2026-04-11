import { Minus, Plus } from "lucide-react";
import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface NumberPickerProps {
  defaultValue?: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  [key: string]: any; // For additional props
}

export default function NumberPicker({
  defaultValue,
  onChange,
  min = 1,
  max = 100,
  ...props
}: NumberPickerProps) {
  const initialValue = defaultValue !== undefined ? defaultValue : min;
  const clampedInitial = Math.max(min, Math.min(max, initialValue));
  const [value, setValue] = React.useState(String(clampedInitial));

  // Sync defaultValue changes
  useEffect(() => {
    if (defaultValue === undefined) return;
    const numValue = Math.max(min, Math.min(max, defaultValue));
    setValue(String(numValue));
    onChange(numValue);
  }, [defaultValue, min, max, onChange]);

  const handleChange = (newValue: number) => {
    const clampedValue = Math.max(min, Math.min(max, newValue));
    setValue(String(clampedValue));
    onChange(clampedValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value.trim();
    setValue(inputValue);

    // Only trigger onChange for valid numbers within range
    const numValue = Number(inputValue);
    if (!isNaN(numValue)) {
      if (numValue >= min && numValue <= max) {
        onChange(numValue);
      }
    }
  };

  const handleBlur = () => {
    const numValue = Number(value);
    if (value === "") {
      setValue(String(min));
      onChange(min);
      return;
    }

    const clampedValue = Math.max(min, Math.min(max, numValue));
    setValue(String(clampedValue));
    onChange(clampedValue);
  };

  const currentValue = Number(value) || min;
  const isMinDisabled = currentValue <= min;
  const isMaxDisabled = currentValue >= max;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 rounded-full"
        onClick={() => handleChange(currentValue - 1)}
        disabled={isMinDisabled}
        aria-label="decrement"
      >
        <Minus size={16} />
      </Button>
      <Input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={handleInputChange}
        onBlur={handleBlur}
        className="w-16 text-center"
        {...props}
      />
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 rounded-full"
        onClick={() => handleChange(currentValue + 1)}
        disabled={isMaxDisabled}
        aria-label="increment"
      >
        <Plus size={16} />
      </Button>
    </div>
  );
}
