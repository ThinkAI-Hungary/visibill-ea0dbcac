import { useTheme } from "@/contexts/ThemeContext";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      richColors
      closeButton
      expand={true}
      visibleToasts={5}
      gap={12}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background/95 group-[.toaster]:backdrop-blur-sm group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:shadow-xl group-[.toaster]:pr-10 group-[.toaster]:relative",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton:
            "!absolute !top-2 !right-2 !left-auto !transform-none !rounded-full !w-6 !h-6 !border !border-slate-200 !bg-slate-100 !text-slate-500 hover:!bg-slate-200 hover:!text-slate-700 hover:!scale-110 !transition-all !duration-150 dark:!border-slate-700 dark:!bg-slate-800 dark:!text-slate-400 dark:hover:!bg-slate-700 dark:hover:!text-slate-200 !flex !items-center !justify-center",
          success:
            "group-[.toaster]:border-emerald-300 group-[.toaster]:shadow-emerald-500/10 dark:group-[.toaster]:border-emerald-700/60 dark:group-[.toaster]:shadow-emerald-500/5",
          icon: "!w-6 !h-6",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
