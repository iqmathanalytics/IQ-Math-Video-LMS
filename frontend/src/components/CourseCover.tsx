type Props = {
  title: string;
  imageUrl?: string | null;
};

const CourseCover = ({ title, imageUrl }: Props) => {
  const letter = (title || "C").trim().charAt(0).toUpperCase() || "C";
  if (!imageUrl) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl text-3xl font-semibold text-white" style={{ background: "#005EB8" }} aria-hidden>
        {letter}
      </div>
    );
  }
  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl bg-slate-200">
      <img
        src={imageUrl}
        alt=""
        className="h-full w-full object-cover"
        onError={(event) => {
          event.currentTarget.style.display = "none";
          const parent = event.currentTarget.parentElement;
          if (parent) parent.textContent = letter;
        }}
      />
    </div>
  );
};

export default CourseCover;
