import { Payment, Type } from '.prisma/client';
import express, { Request, Response } from 'express';
import { TypeElement } from 'typescript';
import {client} from './src/prisma/prisma_client';

/**
 * 
 * Abrir a conexao
 * Query
 * 
 */
const app = express();

/**
 * ? Enables json body and urlencoded requests
 */
app.use(express.json())
app.use(express.urlencoded());

/***
 * ? Home End Point - Nothing to show
 */
app.get('/', async (request:Request,response:Response)=>{
    response.json({
        status:"Running",
        endpoint:"Start route"
    })
})

/**
 * * Update a product on database
 */
app.post('/product/:id?', async(request:Request, response:Response)=>{
    const product = request.body;
    let {id} = request.params;

    console.log(product)
    if(id === undefined){
        id = "0";
    }
    const data = await client.product.upsert({
        where:{
            id:Number(id)??0
        },
        create:{
            nome:product['nome'],
            valor:product['valor'],
            custo:product['custo'],
            lucro:product['lucro'],
            qnt:product['qnt'],
        },
        update:{
            nome:product['nome'],
            valor:product['valor'],
            custo:product['custo'],
            lucro:product['lucro'],
            qnt:product['qnt'],
            active:product['active'],
            userUpdate:{
                connect:{
                    id:Number(product['userUpdate']['id'])
                }
            }
        }
    })

    response.json(data)
})

/***
 *  *Get All products on database
 */
app.get('/product', async(request:Request, response:Response)=>{
    const data = await client.product.findMany({
        orderBy:{
            id: "asc"
        }
    });

    response.json(data);
})

app.get('/product/:id', async(request:Request, response:Response)=>{
    console.warn('GET PRODUCT'+request.params["id"])

    const data = await client.product.findUnique({
        where:{
            id:Number(request.params["id"])
        },
        include:{
            userUpdate:{}
        }
    })

    response.json(data);
})

/**
 * * Register a new cart or add a new item to a existent
 */
app.post('/cart/:id', async(request:Request, response:Response) =>{
    const { productId } = request.query;

    const product = await client.product.findUnique({
        where:{
            id: Number(productId)
        }
    })
    const data = await client.cart.upsert({
        create:{
            items:{
                create:{
                    valor: Number(product?.valor),
                    product:{
                        connect:{
                            id: Number(productId)
                        }
                    }
                }
            }
        },
        update:{
            items:{
                create:{
                    valor: Number(product?.valor),
                    product:{
                        connect:{
                            id:Number(productId)
                        }
                    }
                }
            }
        },
        where:{
            id:Number(request.params["id"])
        }
    })

    response.json(data);
})

app.post('/cart/:id/:item', async(request:Request, response:Response) =>{
    const {id, item} = request.params;
    const cart = request.body;

    const data = await client.cartItem.update({
        where:{
            id: Number(item)
        },
        data:cart
    })

    response.json(data)
})
/**
 * * Get an specific cart on database
 */
app.get('/cart/:id', async (request:Request, response:Response) =>{
    const data = await client.cart.findUnique({
        where:{
            id: Number(request.params["id"])
        },
        include:{
            items:{
                include:{
                    cart:{},
                    product:{}
                }
            }
        }
    })

    response.json(data);
})

app.post("/test/:method", async (request:Request, response:Response)=>{
    const {method} = request.params
    const data: any[] = request.body.items;
    const user:any = request.body.user;
    const dclient = request.body.client;
    const discount = request.body.discount;
    console.log(request.body);
    let items = [];
    let total:number[] = [];
    //Cria um carrinho - OK
    const cart = await client.cart.create({
        data:{}
    })
    //Adiciona todos os itens a um carinho - OK
    for(const e of data){
        let temp = await client.cartItem.create({
            data:{
                valor:Number( e["valor"]),
                quantidade: Number(e["quantidade"]),
                cart:{
                    connect:{
                        id: cart.id
                    }
                },
                product:{
                    connect:{
                        id:Number(e["product"]["id"])
                    }
                }
                
            },
            include:{
                product:{}
            }
        })
        total.push(e["valor"]*e["quantidade"])

        let productUpdate = await client.product.update({
            where:{
                id: temp.product.id
            },
            data:{
                qnt: temp.product.qnt - temp.quantidade
            }
        })
        
        items.push(temp);
    }
    let valorFinal = 0;
    for(const x of total){
        valorFinal += x;
    }
    //Adicionar os items para uma venda 
    const venda = await client.venda.create({
        data:{
            method: method as Payment,
            discount: Number(discount),
            total: valorFinal - Number(discount),
            user:{
                connect:{
                    id:Number(user["id"])
                }
            },
            cart : {
                connect:{
                    id: cart.id
                }
            }
        }
    })
    //Retornar o resultado

    return response.json(venda);
})

/**
 * ! Delete a item on a specific cart on database
 */
app.delete('/cart/:id', async (request:Request, response:Response) =>{
    const{itemId} = request.query
    const data = await client.cartItem.delete({
        where:{
            id: Number(itemId)
        },
        select:{
            quantidade: true,
            valor:true,
        }
    });

    response.json(data);
})
/**
 * * Update cart status from active to inactive
 * ? Path Params id - Cart ID to identify and disable cart
 * ? QueryParams method - Payment method to disable the cart
 */
app.put('/cart/:id', async (request:Request, response:Response) =>{
    const {id} = request.params;
    const {method} = request.query;
    let total = 0;
    const operation = await client.cart.update({
        where:{
            id: Number(id)
        },
        data:{
            active: false
        },
        include:{
            items:{
                include:{
                    product:{}
                }
            }
        }
    })
    operation.items.map(async (x)=>{
        const quantidade = x.quantidade;
        const produto = x.product;

        produto.qnt = produto.qnt - quantidade;
        total += ( x.quantidade * produto.valor)
        await client.product.update({
            where:{
                id: produto.id
            },
            data:produto
        });
    })

    const sell = await client.venda.create({
        data:{
            total,
            method: method as Payment,
            user:{
                connect:{
                    id: 1,
                }
            },
            cart:{
                connect:{
                    id: Number(id)
                }
            }
        }
    })

    return response.json({status:"Carrinho desativado com sucesso e venda finalizada!"})
})

/**
 * * ================================================= FINANÇAS ==========================================================
 */
app.get('/stats', async(request:Request, response:Response) =>{
    console.log('STATISTICAS')
    const data = await client.venda.findMany({
        include:{
            user:{},
            cart:{
                include:{
                    items:{
                        include:{
                            product:{},
                        }
                    },
                },
            }
        }
    })

    response.json(data)
})

app.get('/stats/bydate', async(request:Request, response:Response)=>{
    console.log('Date stats filtering');
    const {de,ate} = request.query;
    const data = await client.venda.findMany({
        where:{
            createdAt:{
                gte:new Date(String(de)),
                lt: new Date(String(ate))
            }
        },
        include:{
            cart:{
                include:{
                    items:{
                        include:{
                            product:{}
                        }
                    }
                }
            }
        }
    })

    response.json(data);
})

/**
 * User creation or update
 */
app.post('/user/create', async(request:Request,response:Response)=>{
    const user = request.body;

    try{
        const data = await client.user.create({
            data:{
                password: user['password'],
                username: user['username'],
                type:String(user['type']).toUpperCase() as Type
            }
        });
        return response.json(data);
    }catch(ex){
        return response.status(500);
    }
})
app.put('/user/update', async(request:Request, response:Response)=>{
    const user = request.body;

    try{
        const data = await client.user.update({
            data:{
                username:user['username'],
                password:user['password'],
                type: String(user['type']).toUpperCase() as Type,
                active: user['active'] as boolean
            },
            where:{
                id: Number(user["id"])
            }
        });
        return response.json(data).status(201);
    }catch(ex){
        return response.status(500);
    }
});
//Signin
app.get('/user', async (request:Request, response:Response) =>{
    console.log("Login")
    const user = request.body;

    const data = await client.user.findFirst({
        where:{
            
            AND:{
                username: user["username"],
                password: user["password"]
            }
            
        }
    })

    response.json(data);
})

app.get('/users', async(request:Request, response:Response)=>{
    console.log('Getall users');

     const data = await client.user.findMany({
     })

     return response.json(data).status(200);
});

/**
 * 
 * 
 * 
 */

app.get('/reports', async(request:Request, response: Response)=>{
    const params = request.body;

    const data = await client.venda.findMany({
        where:{
            createdAt:{
                gte: new Date("2021-11-15"),
                lt: new Date ("2021-11-15 23:59")
            }
        }
    });

    response.json(data);
});
/**
 * ? Server start listening on port 3000 of localhost
 */
app.listen(3000,()=>console.log('Server is running on port localhost:3000'))