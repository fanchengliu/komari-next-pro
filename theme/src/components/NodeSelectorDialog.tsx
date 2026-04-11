import React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Flex } from "@/components/ui/flex";
import NodeSelector from "./NodeSelector";
import { useTranslation } from "react-i18next";

interface NodeSelectorDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  value: string[];
  onChange: (uuids: string[]) => void;
  title?: React.ReactNode;
  className?: string;
  hiddenDescription?: boolean;
  hiddenUuidOnlyClient?: boolean;
  children?: React.ReactNode; // 新增 children 属性
}

const NodeSelectorDialog: React.FC<NodeSelectorDialogProps> = ({
  open: openProp,
  onOpenChange: onOpenChangeProp,
  value,
  onChange,
  title,
  className,
  hiddenDescription,
  hiddenUuidOnlyClient,
  children, // 解构 children
}) => {
  const { t } = useTranslation();
  // 自动/受控弹窗开关
  const [autoOpen, setAutoOpen] = React.useState(false);
  const open = openProp !== undefined ? openProp : autoOpen;
  const onOpenChange = onOpenChangeProp || setAutoOpen;
  // 临时选中，只有点击确定才提交
  const [temp, setTemp] = React.useState<string[]>(value ?? []);
  React.useEffect(() => {
    if (open) setTemp(value ?? []);
  }, [open, value]);

  const handleOk = () => {
    onChange(temp);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {children ? children : <Button>{title || t("common.select")}</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-[400px]">
        <DialogTitle>{title || t("common.select")}</DialogTitle>
        <Flex direction="column" gap="3">
          <NodeSelector
            value={temp}
            onChange={setTemp}
            className={className}
            hiddenUuidOnlyClient={hiddenUuidOnlyClient}
            hiddenDescription={hiddenDescription}
          />
          <Flex justify="end" gap="2">
            <DialogClose asChild>
              <Button variant="outline">{t("common.cancel")}</Button>
            </DialogClose>
            <Button onClick={handleOk}>{t("common.done")}</Button>
          </Flex>
        </Flex>
      </DialogContent>
    </Dialog>
  );
};

export default NodeSelectorDialog;
