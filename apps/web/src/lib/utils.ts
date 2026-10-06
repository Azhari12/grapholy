import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** cn — helper merge Tailwind classes (clsx + twMerge). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
