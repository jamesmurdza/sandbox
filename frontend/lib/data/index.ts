export const projectTemplates: {
  id: string
  name: string
  icon: string
  description: string
  disabled: boolean
}[] = [
  {
    id: "reactjs",
    name: "React",
    icon: "/project-icons/react.svg",
    description: "A single-page web app with ReactJS, Tailwind and ShadCN",
    disabled: false,
  },
  {
    id: "vanillajs",
    name: "HTML/JS",
    icon: "/project-icons/more.svg",
    description: "A simple VanillaJS and HTML web app",
    disabled: false,
  },
  {
    id: "nextjs",
    name: "NextJS",
    icon: "/project-icons/node.svg",
    description: "A full-stack web app with NextJS",
    disabled: false,
  },
  {
    id: "streamlit",
    name: "Streamlit",
    icon: "/project-icons/python.svg",
    description: "A Python application for data science and visualization",
    disabled: false,
  },
]
