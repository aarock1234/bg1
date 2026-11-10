// A minimal stand-in for the responder page that Disney's OneID login talks
// to. It acknowledges the bootstrap and reports every call as done.

type BootstrapMessage = {
  event: string;
};

type BootstrapEvent = MessageEvent<BootstrapMessage>;

type BootstrapHandler = (event: BootstrapEvent) => void;

const handlers: Record<string, BootstrapHandler | undefined> = {
  'comm-bootstrap-start': acknowledgeBootstrap,
  'comm-bootstrap-data': answerCalls,
};

function acknowledgeBootstrap(event: BootstrapEvent) {
  // The bootstrap message is always sent by another window.
  const sender = event.source as WindowProxy;

  sender.postMessage(
    {
      event: 'comm-bootstrap-ack',
      targetName: 'responder',
    },
    '*'
  );
}

// Reports every call received on the event's port as done, with no result.
function answerCalls(event: BootstrapEvent) {
  const [port] = event.ports;

  if (!port) {
    return;
  }

  port.onmessage = (message: MessageEvent) => {
    const { id, type, name } = message.data ?? {};

    if (type !== 'CALL') {
      return;
    }

    port.postMessage({
      id,
      name,
      type: 'CALL_DONE',
      status: 'resolved',
      data: null,
    });
  };
}

addEventListener('message', (event: BootstrapEvent) => {
  handlers[event.data.event]?.(event);
});
