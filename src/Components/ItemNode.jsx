// src/Components/ItemNode.jsx
import IconSelector from '// src/Components/IconSelector';

const ItemNode = ({ data }) => {
  const { category, name, code } = data;

  return (
    <div className="p-4 border rounded shadow bg-white w-[200px]">
      <div className="flex items-center justify-between">
        <IconSelector category={category} />
        <div className="text-sm text-gray-500">{category}</div>
      </div>
      <div className="mt-2 font-semibold">{name}</div>
      <div className="text-xs text-gray-600">{code}</div>
    </div>
  );
};

export default ItemNode;
