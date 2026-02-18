"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface UserAvatarProps {
  name: string
  imageUrl?: string | null
  size?: number
  className?: string
}

export function UserAvatar({ name, imageUrl, size = 18, className }: UserAvatarProps) {
  const hue = (name.charCodeAt(0) * 47 + (name.charCodeAt(1) || 0) * 31) % 360

  return (
    <Avatar
      className={cn("shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {imageUrl && (
        <AvatarImage src={imageUrl} alt={name} />
      )}
      <AvatarFallback
        className="rounded-full"
        style={{
          fontSize: size * 0.48,
          fontWeight: 600,
          background: `hsl(${hue}, 45%, 86%)`,
          color: `hsl(${hue}, 40%, 35%)`,
        }}
      >
        {name[0]}
      </AvatarFallback>
    </Avatar>
  )
}
