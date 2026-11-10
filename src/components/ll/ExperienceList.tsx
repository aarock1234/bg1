import { Experience } from '@/api/ll';

type ExperienceListProps = {
  experiences: Pick<Experience, 'id' | 'name'>[];
  heading: React.ReactNode;
};

// A titled, grouped list of experience names.
export function ExperienceList({ experiences, heading }: ExperienceListProps) {
  return (
    <section>
      <h3 className="section-title">{heading}</h3>
      <ul className="list">
        {experiences.map(experience => (
          <li className="row" key={experience.id}>
            <span className="row-title">{experience.name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
