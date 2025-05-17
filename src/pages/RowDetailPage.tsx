import React from 'react';
import {useParams} from 'react-router-dom';
import {RowDetailProvider} from "@/context/row-detail-context.tsx";
import RowDetailContent from "@/components/rows/row-detail-content.tsx";

const RowDetailPage = () => {
    const {rowId} = useParams<{ rowId: string }>();

    // Use the new settings dropdown in the header
    return (
        <RowDetailProvider rowId={rowId}>
            <RowDetailContent />
        </RowDetailProvider>
    );
};

export default RowDetailPage;
