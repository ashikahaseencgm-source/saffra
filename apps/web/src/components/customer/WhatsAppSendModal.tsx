import { useEffect, useState } from "react";
import { Check, CheckCheck, Copy, Send, MessageCircle } from "lucide-react";
import { Modal, Button, Input, toast } from "@saffra/ui";
import logoIcon from "../../assets/logo.png";

type Phase = "compose" | "sending" | "sent";

export function WhatsAppSendModal({
  open,
  onClose,
  link,
  defaultPhone,
  customerName,
  restaurantName,
  amount,
}: {
  open: boolean;
  onClose: () => void;
  link: string;
  defaultPhone: string;
  customerName: string;
  restaurantName: string;
  amount: number;
}) {
  const [phone, setPhone] = useState(defaultPhone);
  const [phase, setPhase] = useState<Phase>("compose");
  const [delivered, setDelivered] = useState(false);

  useEffect(() => {
    if (open) {
      setPhone(defaultPhone);
      setPhase("compose");
      setDelivered(false);
    }
  }, [open, defaultPhone]);

  function handleSend() {
    setPhase("sending");
    setTimeout(() => setPhase("sent"), 700);
    setTimeout(() => setDelivered(true), 1900);
  }

  function handleCopy() {
    navigator.clipboard.writeText(link).then(
      () => toast.success("Link copied", "Share it with the customer any way you like."),
      () => toast.error("Couldn't copy link"),
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Send Payment Link" size="sm">
      <div className="space-y-4">
        {phase === "compose" && (
          <>
            <Input label="Customer's WhatsApp number" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" />
            <div className="flex items-center gap-2 rounded-lg border border-borderc bg-bg px-3 py-2 text-xs text-muted">
              <span className="truncate">{link}</span>
              <button onClick={handleCopy} className="ml-auto shrink-0 text-secondary hover:underline">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <Button fullWidth disabled={phone.trim().length < 7} onClick={handleSend}>
              <Send className="h-4 w-4" /> Send via WhatsApp
            </Button>
            <p className="text-center text-[11px] text-muted">Simulated for this demo — no real WhatsApp message is sent.</p>
          </>
        )}

        {(phase === "sending" || phase === "sent") && (
          <div className="animate-slide-up">
            <PhoneMockup
              customerName={customerName}
              restaurantName={restaurantName}
              amount={amount}
              link={link}
              messageVisible={phase === "sent"}
              delivered={delivered}
            />
            <Button fullWidth variant="outline" className="mt-4" onClick={onClose}>
              Done
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function PhoneMockup({
  customerName,
  restaurantName,
  amount,
  link,
  messageVisible,
  delivered,
}: {
  customerName: string;
  restaurantName: string;
  amount: number;
  link: string;
  messageVisible: boolean;
  delivered: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-[260px] overflow-hidden rounded-[28px] border-4 border-primary bg-black shadow-elevated">
      <div className="flex items-center gap-2 bg-[#075E54] px-3 py-2.5 text-white">
        <img src={logoIcon} alt="" className="h-7 w-7 rounded-full bg-white p-0.5" />
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{restaurantName}</p>
          <p className="text-[10px] text-white/70">{messageVisible ? "online" : "typing…"}</p>
        </div>
        <MessageCircle className="ml-auto h-4 w-4 text-white/70" />
      </div>

      <div className="h-64 space-y-2 overflow-y-auto bg-[#ECE5DD] px-2.5 py-3">
        <p className="text-center text-[10px] text-muted">Today</p>
        {!messageVisible ? (
          <div className="flex justify-end">
            <div className="flex gap-1 rounded-lg rounded-tr-none bg-[#DCF8C6] px-3 py-2">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.2s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.1s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
            </div>
          </div>
        ) : (
          <div className="flex justify-end animate-slide-up">
            <div className="max-w-[85%] rounded-lg rounded-tr-none bg-[#DCF8C6] px-2.5 py-2 shadow-sm">
              <p className="text-[11px] text-[#111]">
                Hi {customerName.split(" ")[0]}! Your bill at {restaurantName} is ready.
              </p>
              <div className="my-1.5 rounded-md border border-black/10 bg-white/60 p-1.5">
                <p className="text-[10px] font-semibold text-[#111]">Pay ₹{amount.toLocaleString("en-IN")}</p>
                <p className="truncate text-[9px] text-secondary underline">{link}</p>
              </div>
              <div className="flex items-center justify-end gap-1">
                <span className="text-[9px] text-muted">{new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                {delivered ? <CheckCheck className="h-3 w-3 text-secondary" /> : <Check className="h-3 w-3 text-muted" />}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
