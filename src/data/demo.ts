export const planner={name:"Aisha Bello",company:"Aisha Events Studio",stats:{events:6,budget:48250000,quotes:37,variance:8.4},events:[
{id:"wedding-001",client:"Chinedu & Amaka",type:"Wedding",city:"Lagos",guests:350,date:"Dec 14, 2026",budget:12500000,actual:13250000,variance:6,status:"Watch"},
{id:"corporate-003",client:"Vertex Limited",type:"Corporate Dinner",city:"Lagos",guests:260,date:"Nov 22, 2026",budget:8200000,actual:7995000,variance:-2.5,status:"On track"},
{id:"naming-002",client:"Tunde Adeyemi Family",type:"Naming Ceremony",city:"Abuja",guests:180,date:"Oct 10, 2026",budget:4800000,actual:5376000,variance:12,status:"Over"},
{id:"birthday-004",client:"Tunde Adeyemi",type:"Birthday Party",city:"Lagos",guests:120,date:"Sep 28, 2026",budget:3500000,actual:3437000,variance:-1.8,status:"On track"},
],activity:["Lagos Luxe Decor quote updated to ₦2,580,000","New catering quote added from TasteCraft Catering","Vertex event is now 6% over baseline"]};
export const event={...planner.events[0],categories:[
{name:"Venue",budget:2200000,quote:2200000,v:0,vendor:"Eko Garden Events"},{name:"Catering",budget:3150000,quote:3300000,v:150000,vendor:"TasteCraft Catering"},{name:"Decor",budget:2400000,quote:2580000,v:180000,vendor:"Lagos Luxe Decor"},{name:"Photography & Video",budget:1200000,quote:1200000,v:0,vendor:"FrameHouse Studios"},{name:"Entertainment",budget:900000,quote:1050000,v:150000,vendor:"Sound & Soul"},{name:"Miscellaneous",budget:650000,quote:700000,v:50000,vendor:"Various"}]};
export const premium={vendor:"Lagos Luxe Decor",category:"Event Decor",cities:"Lagos · Abuja",priceBand:"₦1M – ₦3M",stats:{matches:184,views:72,clicks:31,enquiries:12},signals:["Lagos Wedding Decor · +18%","Abuja Corporate Events · +11%","Traditional Weddings · +7%","Naming Ceremonies · +5%"]};
export const money=(n:number)=>`₦${n.toLocaleString("en-NG")}`;
