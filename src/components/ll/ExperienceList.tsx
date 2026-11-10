import { Experience } from '@/api/ll';

type ExperienceListProps = {
  bg: string;
  experiences: Pick<Experience, 'id' | 'name'>[];
  heading: React.ReactNode;
};

export function ExperienceList({
  bg,
  experiences,
  heading,
}: ExperienceListProps) {
  return (
    <div className={`mt-4 rounded-sm ${bg}`}>
      <h3 className="mt-0 p-1 text-white text-center">{heading}</h3>
      <ul className="list-disc py-2 pl-8 bg-white/90">
        {experiences.map(experience => (
          <li key={experience.id}>{experience.name}</li>
        ))}
      </ul>
    </div>
  );
}
