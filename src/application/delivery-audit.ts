import {createDeliveryAuditReport,type DeliveryAuditCheck,type DeliveryAuditReport} from "../domain/delivery-audit";
export class DeliveryAuditService { audit(projectId:string,checks:readonly DeliveryAuditCheck[],generatedAt?:string):DeliveryAuditReport{return createDeliveryAuditReport({projectId,checks,generatedAt});} }
