import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useAction } from "../../hooks/queries";
import { useSession } from "../../store/user";

export function FavoriteButton({ marketId }: { marketId: string }) {
  const { role, userId } = useSession();
  const { data: ids = [] } = useQuery({ queryKey: ["favorites", userId], queryFn: api.favorites.list, enabled: role === "TRADER" });
  const saved = ids.includes(marketId);
  const toggle = useAction((id: string) => saved ? api.favorites.remove(id) : api.favorites.add(id));
  if (role !== "TRADER") return null;
  return <button type="button" aria-label={saved ? "Remove from favorites" : "Add to favorites"} aria-pressed={saved}
    className={`btn border ${saved ? "border-gold/40 bg-gold-soft text-gold" : "border-line bg-surface text-muted"}`}
    disabled={toggle.isPending} onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle.mutate(marketId); }}>{saved ? "♥ Favorited" : "♡ Favorite"}
    {toggle.error && <span className="ml-2 text-xs text-no">{toggle.error.message}</span>}
  </button>;
}
