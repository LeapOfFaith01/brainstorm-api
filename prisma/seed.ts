import {PrismaClient} from '@prisma/client'

import mockdata from './mock.json';
const prisma = new PrismaClient();

async function main(){
    // const addMockProducts = await prisma.product.createMany({
    //     data:mockdata
    // })

    // console.log(addMockProducts);

    const addDefaultUser = await prisma.user.create({
        data:{
            username:'admin',
            password:'admin',
            type: 'ADMIN',
        }
    });

    console.log(addDefaultUser);
    
}

main().catch((e)=>{
    console.log(e);
    process.exit(1);
}).finally(()=>{
    prisma.$disconnect();
})