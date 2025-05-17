import {useRowDetailQuery} from "@/context/row-detail-context.tsx";
import Layout from "@/components/layout/layout.tsx";

const RowDetailContent = () => {

    const {data: rowDetail, isLoading} = useRowDetailQuery();

    if (isLoading) {
        return <p>Loading...</p>
    }


    return (
        <Layout
            title={rowDetail?.name}
        >
            <div>Id: {rowDetail.id}</div>
            <div>Name: {rowDetail.name}</div>
            <div>Park: {rowDetail.park.name}</div>
        </Layout>
    )
}

export default RowDetailContent;