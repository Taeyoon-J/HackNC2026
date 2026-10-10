import { useQueryClient } from "@tanstack/react-query";
import { useUsers } from "../../hooks/queries";
import { useUserStore } from "../../store/user";

const ROLE_LABEL = { TRADER: "Trader", ADMIN: "Admin", STUDENT: "Student" } as const;

export function UserSwitcher() {
  const { userId, setUserId } = useUserStore();
  const { data: users = [] } = useUsers();
  const qc = useQueryClient();
  const groups = (["TRADER", "ADMIN", "STUDENT"] as const).map((role) => ({
    role,
    users: users.filter((u) => u.role === role),
  }));
  return (
    <select
      className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
      value={userId}
      onChange={(e) => {
        setUserId(e.target.value);
        qc.invalidateQueries();
      }}
      title="Switch demo user"
    >
      {groups.map((g) => (
        <optgroup key={g.role} label={ROLE_LABEL[g.role]}>
          {g.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.display_name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
