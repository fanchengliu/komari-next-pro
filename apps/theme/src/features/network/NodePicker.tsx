import { useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Plus, Search, X } from "lucide-react";
import { useModel } from "../../data/context";
import { useTranslate } from "../../data/i18n";
import { Flag } from "../../ui/Flag";
import V from "../../ui/v2.module.css";
export function NodePicker({
  selected,
  onChange,
  max = 4,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  max?: number;
}) {
  const { nodes, statuses } = useModel();
  const t = useTranslate();
  const [search, setSearch] = useState(""),
    [error, setError] = useState("");
  const filtered = useMemo(
    () =>
      nodes.filter((n) =>
        [n.name, n.region, n.group, n.os]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [nodes, search],
  );
  return (
    <Popover.Root>
      <Popover.Trigger className={V.smallButton}>
        <Plus size={14} />
        {t("选择节点")}{" "}
        <span className={V.softBadge}>
          {selected.length} / {max}
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={V.popover} sideOffset={8} align="end">
          <div className={V.popoverTitle}>{t("最多选择四台当前可见节点")}</div>
          <label className={V.pickerSearch}>
            <Search size={15} />
            <input
              aria-label={t("筛选对比节点")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("名称、地区、分组…")}
            />
          </label>
          <div className={V.pickerList}>
            {filtered.map((n) => (
              <label className={V.pickerOption} key={n.id}>
                <input
                  type="checkbox"
                  aria-label={n.name}
                  checked={selected.includes(n.id)}
                  onChange={(e) => {
                    setError("");
                    if (e.target.checked) {
                      if (selected.length >= max) {
                        setError(t("最多同时对比四台节点"));
                        return;
                      }
                      onChange([...selected, n.id]);
                    } else onChange(selected.filter((id) => id !== n.id));
                  }}
                />
                <Flag region={n.region} />
                <span>{n.name}</span>
                <small>{statuses[n.id]?.online ? t("在线") : t("离线")}</small>
              </label>
            ))}
          </div>
          {!filtered.length && (
            <p className={V.fieldNote}>{t("没有符合条件的节点")}</p>
          )}
          {error && (
            <p role="status" className={V.error}>
              {error}
            </p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
export function SelectedNodes({
  ids,
  onChange,
}: {
  ids: string[];
  onChange: (ids: string[]) => void;
}) {
  const { nodes } = useModel();
  const t = useTranslate();
  return (
    <div className={V.chips}>
      {ids.map((id) => {
        const n = nodes.find((n) => n.id === id);
        return n ? (
          <div className={V.nodeChip} key={id}>
            <Flag region={n.region} />
            <span title={n.name}>{n.name}</span>
            <button
              aria-label={`${t("移除")} ${n.name}`}
              onClick={() => onChange(ids.filter((x) => x !== id))}
            >
              <X size={12} />
            </button>
          </div>
        ) : null;
      })}
      <NodePicker selected={ids} onChange={onChange} />
    </div>
  );
}
