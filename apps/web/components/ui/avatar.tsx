import { cn } from "@/lib/utils"

export default function Avatar({
  name,
  avatarUrl,
  className,
}: {
  name: string
  avatarUrl?: string | null
  className?: string
}) {
  // Generate initials from name if no avatarUrl is provided
  const initials = name
    ? name
        .split(" ")
        .slice(0, 2)
        .map((letter) => letter[0].toUpperCase())
        .join("")
    : "?"

  return (
    <div
      className={cn(
        "size-9 font-mono rounded-full overflow-hidden bg-gradient-to-t from-neutral-800 to-neutral-600 flex items-center justify-center text-sm font-medium",
        className
      )}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name || "User"}
          width={20}
          height={20}
          className="w-full h-full object-cover"
        />
      ) : (
        initials
      )}
    </div>
  )
}
