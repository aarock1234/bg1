import Button from './Button';

type FloatingButtonProps = Parameters<typeof Button>[0];

// A full-width button fixed to the bottom of the screen. The outer element
// reserves space so the page content can scroll clear of the button.
export default function FloatingButton(props: FloatingButtonProps) {
  return (
    <div className="mb-20">
      <div className="fixed bottom-0 left-0 w-full px-5 pb-5 text-center">
        <Button
          {...props}
          className="max-w-2xl mx-auto shadow-[0px_4px_8px_-1px_#0005]"
          type="full"
        />
      </div>
    </div>
  );
}
