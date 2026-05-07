import { useEffect, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Phone, Mail, Star } from "lucide-react";
import { getLeads, updateLead } from "../api";

const STAGES = [
  { key: "new", label: "New", color: "bg-gray-400" },
  { key: "contacted", label: "Contacted", color: "bg-yellow-400" },
  { key: "interested", label: "Interested", color: "bg-blue-400" },
  { key: "negotiating", label: "Negotiating", color: "bg-purple-400" },
  { key: "converted", label: "Converted", color: "bg-green-400" },
];

export default function Pipeline() {
  const [board, setBoard] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const results = await Promise.all(
        STAGES.map((s) => getLeads({ status: s.key, page_size: 50 }))
      );
      const newBoard = {};
      STAGES.forEach((s, i) => {
        newBoard[s.key] = results[i].data.leads;
      });
      setBoard(newBoard);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const onDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination || source.droppableId === destination.droppableId) return;

    const fromStage = source.droppableId;
    const toStage = destination.droppableId;
    const lead = board[fromStage][source.index];

    setBoard((prev) => {
      const from = [...prev[fromStage]];
      const to = [...prev[toStage]];
      from.splice(source.index, 1);
      to.splice(destination.index, 0, { ...lead, status: toStage });
      return { ...prev, [fromStage]: from, [toStage]: to };
    });

    await updateLead(draggableId, { status: toStage });
  };

  if (loading) {
    return <div className="p-6 text-gray-400">Loading pipeline...</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">Lead Pipeline</h2>
        <p className="text-gray-500 text-sm">Drag leads between stages to update their status</p>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => (
            <div key={stage.key} className="flex-shrink-0 w-64">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                <h3 className="font-semibold text-gray-700 text-sm">{stage.label}</h3>
                <span className="ml-auto badge bg-gray-100 text-gray-500">
                  {board[stage.key]?.length ?? 0}
                </span>
              </div>

              <Droppable droppableId={stage.key}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-32 space-y-2 p-2 rounded-xl transition-colors ${
                      snapshot.isDraggingOver ? "bg-blue-50" : "bg-gray-100"
                    }`}
                  >
                    {board[stage.key]?.map((lead, index) => (
                      <Draggable key={lead.id} draggableId={lead.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`card p-3 cursor-grab active:cursor-grabbing ${
                              snapshot.isDragging ? "shadow-lg rotate-1" : ""
                            }`}
                          >
                            <p className="font-medium text-gray-900 text-sm leading-tight">{lead.business_name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{lead.city} · {lead.category}</p>
                            <div className="flex items-center gap-2 mt-2">
                              {lead.phone && <Phone size={11} className="text-gray-400" />}
                              {lead.email && <Mail size={11} className="text-gray-400" />}
                              {lead.rating && (
                                <span className="flex items-center gap-0.5 text-xs text-yellow-500">
                                  <Star size={10} fill="currentColor" />{lead.rating}
                                </span>
                              )}
                              <span className={`ml-auto badge text-xs ${
                                lead.lead_score >= 70 ? "bg-green-100 text-green-700" :
                                lead.lead_score >= 40 ? "bg-yellow-100 text-yellow-700" :
                                "bg-gray-100 text-gray-500"
                              }`}>
                                {lead.lead_score}
                              </span>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
